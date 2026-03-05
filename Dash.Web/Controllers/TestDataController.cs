using Dash.Domain.Entities;
using Dash.Domain.Enums;
using Dash.Infrastructure.Persistence;
using Dash.Web.Contracts;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Dash.Web.Controllers;

[ApiController]
[Route("api/test-data")]
public sealed class TestDataController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet("catalog")]
    public async Task<IActionResult> GetCatalog(CancellationToken cancellationToken)
    {
        var customers = await dbContext.Customers
            .AsNoTracking()
            .OrderBy(customer => customer.Name)
            .Select(customer => new
            {
                customer.Id,
                customer.Name,
                customer.Segment,
                customer.Region
            })
            .ToListAsync(cancellationToken);

        var products = await dbContext.Products
            .AsNoTracking()
            .OrderBy(product => product.Name)
            .Select(product => new
            {
                product.Id,
                product.Name,
                product.Category,
                product.UnitPrice
            })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            Customers = customers,
            Products = products,
            Statuses = Enum.GetNames<OrderStatus>()
        });
    }

    [HttpPost("orders")]
    public async Task<IActionResult> CreateOrder(
        [FromBody] CreateOrderRequest request,
        CancellationToken cancellationToken)
    {
        if (request.CustomerId <= 0)
        {
            return BadRequest(new { message = "customerId deve ser informado." });
        }

        if (request.Items.Count == 0)
        {
            return BadRequest(new { message = "Informe pelo menos 1 item no pedido." });
        }

        if (!TryParseStatus(request.Status, out var status))
        {
            return BadRequest(new
            {
                message = "status invalido.",
                acceptedStatuses = Enum.GetNames<OrderStatus>()
            });
        }

        var customerExists = await dbContext.Customers
            .AsNoTracking()
            .AnyAsync(customer => customer.Id == request.CustomerId, cancellationToken);
        if (!customerExists)
        {
            return BadRequest(new { message = $"customerId {request.CustomerId} nao encontrado." });
        }

        var productIds = request.Items.Select(item => item.ProductId).Distinct().ToList();
        var products = await dbContext.Products
            .AsNoTracking()
            .Where(product => productIds.Contains(product.Id))
            .Select(product => new
            {
                product.Id,
                product.UnitPrice
            })
            .ToDictionaryAsync(product => product.Id, cancellationToken);

        foreach (var item in request.Items)
        {
            if (item.ProductId <= 0)
            {
                return BadRequest(new { message = "productId deve ser maior que zero." });
            }

            if (item.Quantity <= 0)
            {
                return BadRequest(new { message = "quantity deve ser maior que zero." });
            }

            if (!products.ContainsKey(item.ProductId))
            {
                return BadRequest(new { message = $"productId {item.ProductId} nao encontrado." });
            }
        }

        var orderedAtUtc = NormalizeOrderedAt(request.OrderedAtUtc);
        var order = new Order
        {
            CustomerId = request.CustomerId,
            OrderedAtUtc = orderedAtUtc,
            Status = status
        };

        foreach (var item in request.Items)
        {
            var basePrice = products[item.ProductId].UnitPrice;
            order.Items.Add(new OrderItem
            {
                ProductId = item.ProductId,
                Quantity = item.Quantity,
                UnitPrice = item.UnitPrice ?? basePrice
            });
        }

        dbContext.Orders.Add(order);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(CreateResponse(order));
    }

    [HttpPost("orders/random")]
    public async Task<IActionResult> CreateRandomOrder(
        [FromBody] CreateRandomOrderRequest? request,
        CancellationToken cancellationToken)
    {
        var payload = request ?? new CreateRandomOrderRequest();
        if (!TryParseStatus(payload.Status, out var status))
        {
            return BadRequest(new
            {
                message = "status invalido.",
                acceptedStatuses = Enum.GetNames<OrderStatus>()
            });
        }

        var customersQuery = dbContext.Customers.AsNoTracking();
        int customerId;
        if (payload.CustomerId.HasValue)
        {
            customerId = payload.CustomerId.Value;
            var exists = await customersQuery.AnyAsync(customer => customer.Id == customerId, cancellationToken);
            if (!exists)
            {
                return BadRequest(new { message = $"customerId {customerId} nao encontrado." });
            }
        }
        else
        {
            customerId = await customersQuery
                .OrderBy(customer => customer.Id)
                .Select(customer => customer.Id)
                .FirstOrDefaultAsync(cancellationToken);

            if (customerId == 0)
            {
                return BadRequest(new { message = "Nenhum cliente disponivel para gerar pedido." });
            }
        }

        var allProducts = await dbContext.Products
            .AsNoTracking()
            .Select(product => new
            {
                product.Id,
                product.UnitPrice
            })
            .ToListAsync(cancellationToken);

        if (allProducts.Count == 0)
        {
            return BadRequest(new { message = "Nenhum produto disponivel para gerar pedido." });
        }

        var itemsCount = Math.Clamp(payload.ItemsCount, 1, Math.Min(10, allProducts.Count));
        var maxQuantity = Math.Clamp(payload.MaxQuantityPerItem, 1, 20);
        var variationPercent = Math.Clamp(payload.PriceVariancePercent, 0m, 80m) / 100m;

        var products = allProducts
            .OrderBy(_ => Random.Shared.Next())
            .Take(itemsCount)
            .ToList();

        var order = new Order
        {
            CustomerId = customerId,
            OrderedAtUtc = NormalizeOrderedAt(payload.OrderedAtUtc),
            Status = status
        };

        foreach (var product in products)
        {
            var randomFactor = 1m + ((decimal)Random.Shared.NextDouble() * 2m - 1m) * variationPercent;
            var normalizedFactor = Math.Max(0.05m, randomFactor);

            order.Items.Add(new OrderItem
            {
                ProductId = product.Id,
                Quantity = Random.Shared.Next(1, maxQuantity + 1),
                UnitPrice = decimal.Round(
                    product.UnitPrice * normalizedFactor,
                    2,
                    MidpointRounding.AwayFromZero)
            });
        }

        dbContext.Orders.Add(order);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(CreateResponse(order));
    }

    private static object CreateResponse(Order order)
    {
        var total = order.Items.Sum(item => item.UnitPrice * item.Quantity);
        return new
        {
            order.Id,
            order.CustomerId,
            Status = order.Status.ToString(),
            order.OrderedAtUtc,
            ItemsCount = order.Items.Count,
            Total = decimal.Round(total, 2, MidpointRounding.AwayFromZero)
        };
    }

    private static DateTime NormalizeOrderedAt(DateTime? source)
    {
        if (!source.HasValue)
        {
            return DateTime.UtcNow;
        }

        var value = source.Value;
        if (value.Kind == DateTimeKind.Utc)
        {
            return value;
        }

        if (value.Kind == DateTimeKind.Local)
        {
            return value.ToUniversalTime();
        }

        return DateTime.SpecifyKind(value, DateTimeKind.Utc);
    }

    private static bool TryParseStatus(string? value, out OrderStatus status)
    {
        if (!Enum.TryParse(value, true, out status))
        {
            return false;
        }

        return Enum.IsDefined(status);
    }
}
