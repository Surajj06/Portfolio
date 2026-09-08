using PortfolioApi.Models;

namespace PortfolioApi.Services;

public interface IEmailService
{
    Task SendContactNotificationAsync(ContactMessage message, CancellationToken cancellationToken = default);
}
