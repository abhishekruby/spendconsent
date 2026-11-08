// Pure guards: trusted recording commands still cannot bypass sandbox limits.
export function exactCart(request) {
  const review=request?.review;
  if (!request?.id || !review?.id || review.currency!=='USD'
      || !Number.isInteger(review.total_cents) || review.total_cents<=0 || review.total_cents>=10000)
    throw Error('An exact USD cart strictly below $100 is required');
  return review;
}
export function boundAttempt(request,entry) {
  const review=exactCart(request);
  if (!entry || entry.request!==request.id || entry.review!==review.id
      || entry.total_cents!==review.total_cents || !request.attempt?.id
      || entry.attempt!==request.attempt.id
      || request.attempt.currency!=='USD' || request.attempt.total_cents!==review.total_cents
      || !request.attempt.provider_order_id || entry.provider_order!==request.attempt.provider_order_id)
    throw Error('Action is not bound to this recorded purchase');
}
export function financialControl(command,request,entry) {
  boundAttempt(request,entry);
  if (command.exact===false || command.selector || command.label || command.phone || (command.role && command.role!=='button'))
    throw Error('Financial operations require an exact named button and permitted surface');
  const cents=request.review.total_cents;
  if (command.kind==='pay') {
    if (!command.popup || !['Pay now','Pay Now','Pay','Complete Purchase','Complete purchase','Agree & Pay','Agree and Pay'].includes(command.name))
      throw Error('Payment requires the final button in the sandbox PayPal popup');
    if (request.attempt.state!=='AWAITING_BUYER' || entry.state!=='reserved')
      throw Error('Payment already attempted or not awaiting buyer');
  } else {
    if (command.popup || request.attempt.state!=='PAID') throw Error('Refund requires this verified paid purchase');
    if (command.kind==='open-refund') {
      if (command.name!=='Cancel order & refund') throw Error('Only the refund dialog opener is allowed');
    } else if (command.kind==='refund') {
      if (command.name!==`Yes, cancel and refund $${(cents/100).toFixed(2)}`)
        throw Error('Refund confirmation must name this exact full total');
    } else throw Error('Unknown financial operation');
  }
}
