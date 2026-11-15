export class StreamController {
  constructor(streamService, wsManager) {
    this.streamService = streamService;
    this.wsManager = wsManager;
  }

  processFile = async (req, res, next) => {
    try {
      const highWaterMark = Number(req.body?.highWaterMark) || 64 * 1024;
      const minRating = Number(req.body?.minRating) || 4;
      const includeSample = Boolean(req.body?.includeSample);

      const result = await this.streamService.processLargeFile({
        highWaterMark,
        minRating,
        includeSample
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  getWsClients = (req, res) => {
    res.status(200).json({
      count: this.wsManager.clients.size,
      clients: this.wsManager.getActiveClients()
    });
  };
}