using Dash.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Dash.Infrastructure.Persistence;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<AppUser> Users => Set<AppUser>();

    public DbSet<Customer> Customers => Set<Customer>();

    public DbSet<Product> Products => Set<Product>();

    public DbSet<Order> Orders => Set<Order>();

    public DbSet<OrderItem> OrderItems => Set<OrderItem>();

    public DbSet<DashboardLayout> DashboardLayouts => Set<DashboardLayout>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<AppUser>(entity =>
        {
            entity.ToTable("Users");
            entity.Property(user => user.Name).HasMaxLength(120).IsRequired();
            entity.Property(user => user.Email).HasMaxLength(180).IsRequired();
            entity.HasIndex(user => user.Email).IsUnique();
        });

        modelBuilder.Entity<Customer>(entity =>
        {
            entity.ToTable("Customers");
            entity.Property(customer => customer.Name).HasMaxLength(150).IsRequired();
            entity.Property(customer => customer.Segment).HasMaxLength(80).IsRequired();
            entity.Property(customer => customer.Region).HasMaxLength(80).IsRequired();
        });

        modelBuilder.Entity<Product>(entity =>
        {
            entity.ToTable("Products");
            entity.Property(product => product.Name).HasMaxLength(120).IsRequired();
            entity.Property(product => product.Category).HasMaxLength(80).IsRequired();
            entity.Property(product => product.UnitPrice).HasColumnType("decimal(18,2)");
        });

        modelBuilder.Entity<Order>(entity =>
        {
            entity.ToTable("Orders");
            entity.Property(order => order.Status)
                .HasConversion<string>()
                .HasMaxLength(32)
                .IsRequired();
            entity.Property(order => order.OrderedAtUtc).IsRequired();

            entity.HasOne(order => order.Customer)
                .WithMany(customer => customer.Orders)
                .HasForeignKey(order => order.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<OrderItem>(entity =>
        {
            entity.ToTable("OrderItems");
            entity.Property(item => item.UnitPrice).HasColumnType("decimal(18,2)");

            entity.HasOne(item => item.Order)
                .WithMany(order => order.Items)
                .HasForeignKey(item => item.OrderId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(item => item.Product)
                .WithMany(product => product.OrderItems)
                .HasForeignKey(item => item.ProductId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<DashboardLayout>(entity =>
        {
            entity.ToTable("DashboardLayouts");
            entity.Property(layout => layout.Name).HasMaxLength(120).IsRequired();
            entity.Property(layout => layout.LayoutJson).IsRequired();
            entity.Property(layout => layout.CreatedAtUtc).IsRequired();
            entity.Property(layout => layout.UpdatedAtUtc).IsRequired();

            entity.HasOne(layout => layout.OwnerUser)
                .WithMany(user => user.DashboardLayouts)
                .HasForeignKey(layout => layout.OwnerUserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
