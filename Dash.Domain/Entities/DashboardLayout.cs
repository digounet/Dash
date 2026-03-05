namespace Dash.Domain.Entities;

public class DashboardLayout
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public int OwnerUserId { get; set; }

    public string LayoutJson { get; set; } = string.Empty;

    public bool IsShared { get; set; }

    public bool IsDefault { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public DateTime UpdatedAtUtc { get; set; }

    public AppUser? OwnerUser { get; set; }
}
