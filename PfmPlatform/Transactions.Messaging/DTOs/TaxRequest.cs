using Transactions.Messaging.Models;

namespace Transactions.Messaging.DTOs;

public class TaxRequest
{
    public string RequestId { get; set; } = Guid.NewGuid().ToString();
    public List<Transaction> Transactions { get; set; } = new();
}