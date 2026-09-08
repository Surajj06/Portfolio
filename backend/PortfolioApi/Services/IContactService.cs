using PortfolioApi.DTOs;

namespace PortfolioApi.Services;

public interface IContactService
{
    Task<ContactResponseDto> SubmitAsync(ContactRequestDto request, CancellationToken cancellationToken = default);
}
