using Dash.Domain.Entities;
using Dash.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Dash.Infrastructure.Persistence;

public static class AppDbSeeder
{
    private const string DefaultLayoutJson =
        """
        [
          {"id":"widget-monthly-revenue","x":0,"y":0,"w":6,"h":4},
          {"id":"widget-category-revenue","x":6,"y":0,"w":6,"h":4},
          {"id":"widget-orders-status","x":0,"y":4,"w":12,"h":4}
        ]
        """;

    private const string OpsLayoutJson =
        """
        [
          {"id":"widget-monthly-revenue","x":0,"y":0,"w":12,"h":4},
          {"id":"widget-category-revenue","x":0,"y":4,"w":7,"h":4},
          {"id":"widget-orders-status","x":7,"y":4,"w":5,"h":4}
        ]
        """;

    public static async Task SeedAsync(AppDbContext dbContext, CancellationToken cancellationToken = default)
    {
        if (await dbContext.Users.AnyAsync(cancellationToken))
        {
            return;
        }

        var users = new List<AppUser>
        {
            new() { Name = "Pablo", Email = "pablo@dash.local" },
            new() { Name = "Lenin", Email = "lenin@dash.local" },
            new() { Name = "Vanuza", Email = "vanuza@dash.local" }
        };

        var customers = new List<Customer>
        {
            new() { Name = "Mercado Sol", Segment = "Varejo", Region = "Nordeste" },
            new() { Name = "Grupo Atlas", Segment = "Industria", Region = "Sudeste" },
            new() { Name = "Loja Aurora", Segment = "Varejo", Region = "Sul" },
            new() { Name = "Comercial Horizonte", Segment = "Distribuidor", Region = "Centro-Oeste" },
            new() { Name = "Hospital Vida", Segment = "Saude", Region = "Sudeste" },
            new() { Name = "Construtora Delta", Segment = "Construcao", Region = "Norte" },
            new() { Name = "Rede Mar Azul", Segment = "Servicos", Region = "Nordeste" },
            new() { Name = "Papelaria Prisma", Segment = "Varejo", Region = "Sul" }
        };

        var products = new List<Product>
        {
            new() { Name = "Sensor IoT", Category = "Hardware", UnitPrice = 899m },
            new() { Name = "Gateway Edge", Category = "Hardware", UnitPrice = 1450m },
            new() { Name = "Licenca Basic", Category = "Software", UnitPrice = 220m },
            new() { Name = "Licenca Pro", Category = "Software", UnitPrice = 490m },
            new() { Name = "Suporte Nivel 1", Category = "Servicos", UnitPrice = 380m },
            new() { Name = "Suporte Nivel 2", Category = "Servicos", UnitPrice = 620m },
            new() { Name = "Treinamento Onsite", Category = "Treinamento", UnitPrice = 2100m },
            new() { Name = "Pacote Integracao", Category = "Consultoria", UnitPrice = 3200m }
        };

        await dbContext.Users.AddRangeAsync(users, cancellationToken);
        await dbContext.Customers.AddRangeAsync(customers, cancellationToken);
        await dbContext.Products.AddRangeAsync(products, cancellationToken);

        var random = new Random(42);
        var orders = GenerateOrders(customers, products, random);
        await dbContext.Orders.AddRangeAsync(orders, cancellationToken);

        var now = DateTime.UtcNow;
        var layouts = new List<DashboardLayout>();
        foreach (var user in users)
        {
            layouts.Add(new DashboardLayout
            {
                Name = "Meu Layout",
                OwnerUser = user,
                LayoutJson = DefaultLayoutJson,
                IsShared = false,
                IsDefault = true,
                CreatedAtUtc = now,
                UpdatedAtUtc = now
            });
        }

        layouts.Add(new DashboardLayout
        {
            Name = "Operacoes Semanais",
            OwnerUser = users[0],
            LayoutJson = OpsLayoutJson,
            IsShared = true,
            IsDefault = false,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        });

        await dbContext.DashboardLayouts.AddRangeAsync(layouts, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static List<Order> GenerateOrders(
        IReadOnlyList<Customer> customers,
        IReadOnlyList<Product> products,
        Random random)
    {
        var orders = new List<Order>();
        var baseMonth = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1).AddMonths(-11);

        for (var monthOffset = 0; monthOffset < 12; monthOffset++)
        {
            var month = baseMonth.AddMonths(monthOffset);
            var ordersThisMonth = random.Next(14, 24);

            for (var i = 0; i < ordersThisMonth; i++)
            {
                var customer = customers[random.Next(customers.Count)];
                var orderedAt = month
                    .AddDays(random.Next(0, 27))
                    .AddHours(random.Next(8, 20))
                    .AddMinutes(random.Next(0, 60));

                var order = new Order
                {
                    Customer = customer,
                    OrderedAtUtc = orderedAt,
                    Status = PickStatus(random)
                };

                var itemsCount = random.Next(1, 4);
                for (var itemIdx = 0; itemIdx < itemsCount; itemIdx++)
                {
                    var product = products[random.Next(products.Count)];
                    var unitPrice = product.UnitPrice * (decimal)(0.9 + random.NextDouble() * 0.3);
                    order.Items.Add(new OrderItem
                    {
                        Product = product,
                        Quantity = random.Next(1, 6),
                        UnitPrice = decimal.Round(unitPrice, 2, MidpointRounding.AwayFromZero)
                    });
                }

                orders.Add(order);
            }
        }

        return orders;
    }

    private static OrderStatus PickStatus(Random random)
    {
        var pick = random.Next(1, 101);
        if (pick <= 10)
        {
            return OrderStatus.Cancelled;
        }

        if (pick <= 35)
        {
            return OrderStatus.Pending;
        }

        if (pick <= 72)
        {
            return OrderStatus.Confirmed;
        }

        return OrderStatus.Delivered;
    }
}
