using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Transactions.Worker;

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddHostedService<TaxResponseConsumer>();
var host = builder.Build();
host.Run();