namespace Dash.Web.Contracts;

public sealed class CreateOrderItemRequest
{
    public int ProductId { get; init; }

    public int Quantity { get; init; } = 1;

    public decimal? UnitPrice { get; init; }
}
