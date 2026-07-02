using Microsoft.AspNetCore.Mvc;
using StackExchange.Redis;
using System.Text.Json;
using Transactions.Messaging.DTOs;
using Transactions.Messaging.Models;
using Transactions.API.Services;

namespace Transactions.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TaxController : ControllerBase
{
    private readonly KafkaProducerService _producer;
    private readonly IConnectionMultiplexer _redis;

    public TaxController(KafkaProducerService producer, IConnectionMultiplexer redis)
    {
        _producer = producer;
        _redis = redis;
    }

    [HttpPost("analyze")]
    public async Task<IActionResult> Analyze([FromBody] List<Transaction> transactions)
    {
        var request = new TaxRequest
        {
            RequestId = Guid.NewGuid().ToString(),
            Transactions = transactions
        };

        await _producer.SendTaxRequestAsync(request);
        return Ok(new { requestId = request.RequestId, message = "Request accepted. Use /result/{id} to get analysis." });
    }

    [HttpGet("result/{requestId}")]
    public async Task<IActionResult> GetResult(string requestId)
    {
        var db = _redis.GetDatabase();
        var resultJson = await db.StringGetAsync($"result:{requestId}");
        if (resultJson.IsNullOrEmpty)
            return NotFound(new { message = "Result not ready yet or invalid requestId" });

        var result = JsonSerializer.Deserialize<TaxResponse>(resultJson!);
        return Ok(result);
    }
}