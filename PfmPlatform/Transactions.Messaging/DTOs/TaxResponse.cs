namespace Transactions.Messaging.DTOs;

public class DeductionResult
{
    public string TransactionId { get; set; } = "";
    public string DeductionType { get; set; } = "none";   // social, property, investment, professional
    public string Reason { get; set; } = "";
    public decimal EligibleAmount { get; set; }
}

public class Summary
{
    public decimal TotalEligible { get; set; }
    public decimal EstimatedRefund { get; set; }
}

public class TaxResponse
{
    public string RequestId { get; set; } = "";
    public List<DeductionResult> Deductions { get; set; } = new();
    public Summary Summary { get; set; } = new();
}