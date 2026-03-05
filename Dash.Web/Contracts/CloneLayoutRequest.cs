namespace Dash.Web.Contracts;

public sealed class CloneLayoutRequest
{
    public int UserId { get; init; }

    public string? Name { get; init; }

    public bool SetAsDefault { get; init; } = true;
}
