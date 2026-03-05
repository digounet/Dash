namespace Dash.Domain.Entities;

public class Customer
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Segment { get; set; } = string.Empty;

    public string Region { get; set; } = string.Empty;

    public ICollection<Order> Orders { get; set; } = new List<Order>();
}
