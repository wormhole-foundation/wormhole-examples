import http = require("http");
import parseURL = require("whatwg-url");
import client = require("prom-client");

// NOTE:  To create a new metric:
// 1) Create a private counter/gauge with appropriate name and help
// 2) Create a method to set the metric to a value
// 3) Register the metric

export class PromHelper {
  private register = new client.Registry();
  private label: string;

  // Actual metrics
  private seqNumGauge = new client.Gauge({
    name: "seqNum",
    help: "Last sent sequence number",
  });
  private successCounter = new client.Counter({
    name: "successes",
    help: "number of successful relays",
  });
  private failureCounter = new client.Counter({
    name: "failures",
    help: "number of failed relays",
  });
  private completeTime = new client.Histogram({
    name: "complete_time",
    help: "Time is took to complete transfer",
    buckets: [200, 400, 600, 800, 1000, 2000],
  });
  private walletBalance = new client.Gauge({
    name: "walletBalance",
    help: "The wallet balance",
  });
  private listenCounter = new client.Counter({
    name: "VAAs_received",
    help: "number of Pyth VAAs received",
  });
  // End metrics

  private server = http.createServer(async (req, res) => {
    // Retrieve route from request object
    const route = parseURL.pathname;

    if (route === "/metrics") {
      // Return all metrics the Prometheus exposition format
      res.setHeader("Content-Type", this.register.contentType);
      res.end(await this.register.metrics());
    }
  });

  constructor(name: string, port) {
    this.label = name;
    this.register.setDefaultLabels({
      app: name,
    });

    // Register each metric
    this.register.registerMetric(this.seqNumGauge);
    this.register.registerMetric(this.successCounter);
    this.register.registerMetric(this.failureCounter);
    this.register.registerMetric(this.completeTime);
    this.register.registerMetric(this.walletBalance);
    this.register.registerMetric(this.listenCounter);
    // End registering metric

    this.server.listen(port);
  }

  // These are the accessor methods for the metrics
  setSeqNum(sn) {
    this.seqNumGauge.set(sn);
  }
  incSuccesses() {
    this.successCounter.inc();
  }
  incFailures() {
    this.failureCounter.inc();
  }
  addCompleteTime(val) {
    this.completeTime.observe(val);
  }
  setWalletBalance(bal) {
    this.walletBalance.set(bal);
  }
  incIncoming() {
    this.listenCounter.inc();
  }
}
