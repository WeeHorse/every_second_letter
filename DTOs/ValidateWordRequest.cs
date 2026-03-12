using System.Text.Json.Serialization;

namespace EverySecondLetter.DTOs;

public sealed record ValidateWordRequest(
    [property: JsonPropertyName("word")]
    string Word
);
