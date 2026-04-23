const { onCall } = require("firebase-functions/v2/https")
const logger = require("firebase-functions/logger")

exports.getRentEstimate = onCall({ cors: true }, (request) => {
  const price = request.data?.price
  if (!price) {
    return { error: "Price is required" }
  }
  
  // Basic heuristic: ~0.7% of property price as monthly rent
  const estimate = Math.round(price * 0.007)
  
  logger.info(`Rent estimate requested for price: ${price}, returning: ${estimate}`)
  return { estimate }
})
