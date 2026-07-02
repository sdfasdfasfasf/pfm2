using Confluent.Kafka;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using System.Text.Json;

namespace Transactions.Worker;

public class TaxResponseConsumer : BackgroundService
{
    private readonly IConsumer<string, string> _consumer;
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<TaxResponseConsumer> _logger;
    private readonly string _topic = "tax-responses";

    public TaxResponseConsumer(IConfiguration config, ILogger<TaxResponseConsumer> logger)
    {
        _logger = logger;
        var consumerConfig = new ConsumerConfig
        {
            BootstrapServers = config["Kafka:BootstrapServers"],
            GroupId = "transactions-worker-group",
            AutoOffsetReset = AutoOffsetReset.Earliest,
            EnableAutoCommit = true
        };
        _consumer = new ConsumerBuilder<string, string>(consumerConfig).Build();
        _consumer.Subscribe(_topic);
        _redis = ConnectionMultiplexer.Connect(config["Redis:ConnectionString"]);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Run(async () =>
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var result = _consumer.Consume(stoppingToken);
                    if (result != null)
                    {
                        var db = _redis.GetDatabase();
                        await db.StringSetAsync($"result:{result.Message.Key}", result.Message.Value, TimeSpan.FromHours(1));
                        _logger.LogInformation("Saved result for request {RequestId}", result.Message.Key);
                    }
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error consuming message");
                }
            }
        }, stoppingToken);
    }

    public override void Dispose()
    {
        _consumer.Close();
        _redis.Dispose();
        base.Dispose();
    }
}