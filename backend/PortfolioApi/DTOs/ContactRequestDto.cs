using System.ComponentModel.DataAnnotations;

namespace PortfolioApi.DTOs;

/// <summary>
/// Shape of the JSON body accepted by POST /api/contact.
/// </summary>
public sealed class ContactRequestDto
{
    [Required(ErrorMessage = "Name is required.")]
    [StringLength(120, MinimumLength = 2, ErrorMessage = "Name must be between 2 and 120 characters.")]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessage = "Email is required.")]
    [EmailAddress(ErrorMessage = "A valid email address is required.")]
    [StringLength(254)]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Message is required.")]
    [StringLength(4000, MinimumLength = 10, ErrorMessage = "Message must be between 10 and 4000 characters.")]
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// Honeypot field. Real users never populate this — bots often do.
    /// Left out of validation on purpose; checked manually in the service.
    /// </summary>
    public string? Website { get; set; }
}
