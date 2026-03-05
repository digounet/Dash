using Dash.Application.Abstractions.Persistence;
using Dash.Application.Abstractions.Services;
using Dash.Application.DTOs;
using Dash.Domain.Entities;

namespace Dash.Application.Features.Layouts;

public sealed class DashboardLayoutService(
    IUserRepository userRepository,
    IDashboardLayoutRepository layoutRepository,
    IUnitOfWork unitOfWork) : IDashboardLayoutService
{
    public async Task<LayoutCatalogDto> GetCatalogAsync(int userId, CancellationToken cancellationToken)
    {
        var user = await userRepository.GetByIdAsync(userId, cancellationToken)
            ?? throw new InvalidOperationException($"Usuario {userId} nao encontrado.");

        var ownLayouts = await layoutRepository.GetByOwnerAsync(userId, cancellationToken);
        var sharedLayouts = await layoutRepository.GetSharedByOtherUsersAsync(userId, cancellationToken);

        var activeLayout = ownLayouts
            .OrderByDescending(layout => layout.IsDefault)
            .ThenByDescending(layout => layout.UpdatedAtUtc)
            .FirstOrDefault();

        var ownDtos = ownLayouts
            .OrderByDescending(layout => layout.IsDefault)
            .ThenByDescending(layout => layout.UpdatedAtUtc)
            .Select(layout => MapToDto(layout, user.Name))
            .ToList();

        var sharedDtos = sharedLayouts
            .OrderByDescending(layout => layout.UpdatedAtUtc)
            .Select(layout => MapToDto(layout, layout.OwnerUser?.Name ?? "Usuario"))
            .ToList();

        return new LayoutCatalogDto(
            activeLayout is null ? null : MapToDto(activeLayout, user.Name),
            ownDtos,
            sharedDtos);
    }

    public async Task<DashboardLayoutDto> SaveAsync(SaveDashboardLayoutCommand command, CancellationToken cancellationToken)
    {
        if (command.UserId <= 0)
        {
            throw new InvalidOperationException("Usuario invalido.");
        }

        if (string.IsNullOrWhiteSpace(command.Name))
        {
            throw new InvalidOperationException("Nome do layout eh obrigatorio.");
        }

        if (string.IsNullOrWhiteSpace(command.LayoutJson))
        {
            throw new InvalidOperationException("LayoutJson eh obrigatorio.");
        }

        var owner = await userRepository.GetByIdAsync(command.UserId, cancellationToken)
            ?? throw new InvalidOperationException($"Usuario {command.UserId} nao encontrado.");

        var ownerLayouts = await layoutRepository.GetByOwnerAsync(command.UserId, cancellationToken);
        DashboardLayout layout;

        if (command.LayoutId.HasValue)
        {
            layout = ownerLayouts.FirstOrDefault(item => item.Id == command.LayoutId.Value)
                ?? throw new InvalidOperationException("Layout nao pertence ao usuario.");
        }
        else
        {
            layout = new DashboardLayout
            {
                Name = command.Name.Trim(),
                OwnerUserId = command.UserId,
                CreatedAtUtc = DateTime.UtcNow
            };

            await layoutRepository.AddAsync(layout, cancellationToken);
        }

        layout.Name = command.Name.Trim();
        layout.LayoutJson = command.LayoutJson;
        layout.IsShared = command.IsShared;
        layout.IsDefault = command.IsDefault;
        layout.UpdatedAtUtc = DateTime.UtcNow;

        if (layout.CreatedAtUtc == default)
        {
            layout.CreatedAtUtc = layout.UpdatedAtUtc;
        }

        if (layout.IsDefault)
        {
            foreach (var item in ownerLayouts.Where(item => item.Id != layout.Id))
            {
                item.IsDefault = false;
            }
        }
        else if (!ownerLayouts.Any(item => item.Id != layout.Id && item.IsDefault))
        {
            layout.IsDefault = true;
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return MapToDto(layout, owner.Name);
    }

    public async Task<DashboardLayoutDto> CloneSharedAsync(
        CloneDashboardLayoutCommand command,
        CancellationToken cancellationToken)
    {
        if (command.UserId <= 0)
        {
            throw new InvalidOperationException("Usuario invalido.");
        }

        var user = await userRepository.GetByIdAsync(command.UserId, cancellationToken)
            ?? throw new InvalidOperationException($"Usuario {command.UserId} nao encontrado.");

        var sourceLayout = await layoutRepository.GetByIdAsync(command.SourceLayoutId, cancellationToken)
            ?? throw new InvalidOperationException("Layout compartilhado nao encontrado.");

        if (!sourceLayout.IsShared)
        {
            throw new InvalidOperationException("Somente layouts compartilhados podem ser clonados.");
        }

        var ownerLayouts = await layoutRepository.GetByOwnerAsync(command.UserId, cancellationToken);
        if (command.SetAsDefault)
        {
            foreach (var layout in ownerLayouts)
            {
                layout.IsDefault = false;
            }
        }

        var newLayout = new DashboardLayout
        {
            Name = string.IsNullOrWhiteSpace(command.Name)
                ? $"{sourceLayout.Name} (copia)"
                : command.Name.Trim(),
            OwnerUserId = command.UserId,
            LayoutJson = sourceLayout.LayoutJson,
            IsShared = false,
            IsDefault = command.SetAsDefault || !ownerLayouts.Any(item => item.IsDefault),
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };

        await layoutRepository.AddAsync(newLayout, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return MapToDto(newLayout, user.Name);
    }

    private static DashboardLayoutDto MapToDto(DashboardLayout layout, string ownerName)
    {
        return new DashboardLayoutDto(
            layout.Id,
            layout.Name,
            layout.LayoutJson,
            layout.IsShared,
            layout.IsDefault,
            layout.OwnerUserId,
            ownerName,
            layout.UpdatedAtUtc);
    }
}
