using Dash.Application.Abstractions.Persistence;
using Dash.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Dash.Infrastructure.Persistence.Repositories;

public sealed class SalesAnalyticsRepository(AppDbContext dbContext) : ISalesAnalyticsRepository
{
    public async Task<IReadOnlyList<MonthlyRevenuePoint>> GetMonthlyRevenueAsync(
        DateTime startAtUtc,
        DateTime endAtUtc,
        CancellationToken cancellationToken)
    {
        var rows = await (
            from item in dbContext.OrderItems.AsNoTracking()
            join order in dbContext.Orders.AsNoTracking() on item.OrderId equals order.Id
            where order.OrderedAtUtc >= startAtUtc
                  && order.OrderedAtUtc <= endAtUtc
                  && (order.Status == OrderStatus.Confirmed || order.Status == OrderStatus.Delivered)
            group item by new { order.OrderedAtUtc.Year, order.OrderedAtUtc.Month }
            into grouped
            orderby grouped.Key.Year, grouped.Key.Month
            select new
            {
                grouped.Key.Year,
                grouped.Key.Month,
                Revenue = grouped.Sum(row => row.UnitPrice * row.Quantity)
            })
            .ToListAsync(cancellationToken);

        return rows
            .Select(row => new MonthlyRevenuePoint(row.Year, row.Month, row.Revenue))
            .ToList();
    }

    public async Task<IReadOnlyList<CategoryRevenuePoint>> GetRevenueByCategoryAsync(
        DateTime startAtUtc,
        DateTime endAtUtc,
        CancellationToken cancellationToken)
    {
        var rows = await (
            from item in dbContext.OrderItems.AsNoTracking()
            join order in dbContext.Orders.AsNoTracking() on item.OrderId equals order.Id
            join product in dbContext.Products.AsNoTracking() on item.ProductId equals product.Id
            where order.OrderedAtUtc >= startAtUtc
                  && order.OrderedAtUtc <= endAtUtc
                  && (order.Status == OrderStatus.Confirmed || order.Status == OrderStatus.Delivered)
            group new { item, product } by product.Category
            into grouped
            orderby grouped.Sum(row => row.item.UnitPrice * row.item.Quantity) descending
            select new
            {
                Category = grouped.Key,
                Revenue = grouped.Sum(row => row.item.UnitPrice * row.item.Quantity)
            })
            .ToListAsync(cancellationToken);

        return rows
            .Select(row => new CategoryRevenuePoint(row.Category, row.Revenue))
            .ToList();
    }

    public async Task<IReadOnlyList<OrderStatusPoint>> GetOrderStatusTotalsAsync(
        DateTime startAtUtc,
        DateTime endAtUtc,
        CancellationToken cancellationToken)
    {
        var rows = await dbContext.Orders
            .AsNoTracking()
            .Where(order => order.OrderedAtUtc >= startAtUtc && order.OrderedAtUtc <= endAtUtc)
            .GroupBy(order => order.Status)
            .Select(grouped => new
            {
                grouped.Key,
                Total = grouped.Count()
            })
            .ToListAsync(cancellationToken);

        return rows
            .Select(row => new OrderStatusPoint(row.Key.ToString(), row.Total))
            .ToList();
    }
}
