using Dash.Domain.Enums;

namespace Dash.Domain.Entities;

public class Order
{
    public int Id { get; set; }

    public int CustomerId { get; set; }

    public DateTime OrderedAtUtc { get; set; }

    public OrderStatus Status { get; set; }

    public Customer? Customer { get; set; }

    public ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();
}
