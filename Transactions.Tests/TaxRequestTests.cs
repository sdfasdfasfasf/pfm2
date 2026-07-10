using System.Text.Json;
using Transactions.Messaging.DTOs;
using Transactions.Messaging.Models;
using Xunit;

namespace Transactions.Tests;

public class TaxRequestTests
{
    [Fact]
    public void TaxRequest_Serialization_ShouldPreserveData()
    {
        // Arrange
        var request = new TaxRequest
        {
            RequestId = Guid.NewGuid().ToString(),
            Transactions = new List<Transaction>
            {
                new() { Id = "1", Date = "2025-01-01", Description = "Тестовая транзакция", Amount = 1000 }
            }
        };

        // Act
        var json = JsonSerializer.Serialize(request);
        var deserialized = JsonSerializer.Deserialize<TaxRequest>(json);

        // Assert
        Assert.NotNull(deserialized);
        Assert.Equal(request.RequestId, deserialized.RequestId);
        Assert.Single(deserialized.Transactions);
        Assert.Equal(request.Transactions[0].Id, deserialized.Transactions[0].Id);
        Assert.Equal(request.Transactions[0].Amount, deserialized.Transactions[0].Amount);
    }

    [Fact]
    public void TaxRequest_Serialization_ShouldPreserveDataSecond()
    {
        // Arrange
        var request = new TaxRequest
        {
            RequestId = Guid.NewGuid().ToString(),
            Transactions = new List<Transaction>
            {
                new() { Id = "2", Date = "2025-01-01", Description = "Тестовая транзакция", Amount = 1000 }
            }
        };

        // Act
        var json = JsonSerializer.Serialize(request);
        var deserialized = JsonSerializer.Deserialize<TaxRequest>(json);

        // Assert
        Assert.NotNull(deserialized);
        Assert.Equal(request.RequestId, deserialized.RequestId);
        Assert.Single(deserialized.Transactions);
        Assert.Equal(request.Transactions[0].Id, deserialized.Transactions[0].Id);
        Assert.Equal(request.Transactions[0].Amount, deserialized.Transactions[0].Amount);
    }
}