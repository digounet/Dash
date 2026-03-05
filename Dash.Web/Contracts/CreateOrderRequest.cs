namespace Dash.Web.Contracts;

public sealed class CreateOrderRequest
{
    public int CustomerId { get; init; }

    public string Status { get; init; } = "Confirmed";

    public DateTime? OrderedAtUtc { get; init; }

    public IReadOnlyList<CreateOrderItemRequest> Items { get; init; } = [];
}
