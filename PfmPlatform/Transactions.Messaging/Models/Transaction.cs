namespace Transactions.Messaging.Models;

public class Transaction
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Date { get; set; } = DateTime.UtcNow.ToString("yyyy-MM-dd");
    public string Description { get; set; } = "";
    public decimal Amount { get; set; }
}