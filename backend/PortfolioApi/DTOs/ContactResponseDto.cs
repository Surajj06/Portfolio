namespace PortfolioApi.DTOs;

public sealed class ContactResponseDto
{
    public bool Success { get; init; }
    public string Message { get; init; } = string.Empty;
}
