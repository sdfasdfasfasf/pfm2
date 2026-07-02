using Confluent.Kafka;
using System.Text.Json;
using Transactions.Messaging.DTOs;

namespace Transactions.API.Services;

public class KafkaProducerService
{
    private readonly IProducer<string, string> _producer;
    private readonly string _topic = "tax-requests";

    public KafkaProducerService(IConfiguration config)
    {
        var producerConfig = new ProducerConfig
        {
            BootstrapServers = config["Kafka:BootstrapServers"]
        };
        _producer = new ProducerBuilder<string, string>(producerConfig).Build();
    }

    public async Task SendTaxRequestAsync(TaxRequest request)
    {
        var message = new Message<string, string>
        {
            Key = request.RequestId,
            Value = JsonSerializer.Serialize(request)
        };
        await _producer.ProduceAsync(_topic, message);
    }
}