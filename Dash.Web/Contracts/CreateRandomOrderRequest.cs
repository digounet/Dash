namespace Dash.Web.Contracts;

public sealed class CreateRandomOrderRequest
{
    public int? CustomerId { get; init; }

    public string Status { get; init; } = "Confirmed";

    public DateTime? OrderedAtUtc { get; init; }

    public int ItemsCount { get; init; } = 2;

    public int MaxQuantityPerItem { get; init; } = 5;

    public decimal PriceVariancePercent { get; init; } = 10m;
}
