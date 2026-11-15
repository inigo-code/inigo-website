// Single-server queue, M/M/1 (Poisson arrivals, exponential service, first come first served,
// unlimited queue and population). λ = arrival rate, μ = service rate, in the same time unit.

import { clean } from "./num.js";

export function validate(lambda, mu) {
  const errors = [];
  if (!(lambda > 0)) errors.push("The arrival rate λ must be a positive number.");
  if (!(mu > 0)) errors.push("The service rate μ must be a positive number.");
  if (lambda > 0 && mu > 0 && lambda >= mu) errors.push(`The arrival rate (${clean(lambda)}) must be less than the service rate (${clean(mu)}). Otherwise the queue grows without limit and there is no steady state.`);
  return errors;
}

export function mm1(lambda, mu) {
  const rho = lambda / mu;
  return {
    lambda, mu, rho,
    p0: 1 - rho,                                   // probability the system is empty (server idle)
    ls: lambda / (mu - lambda),                    // expected number in the system
    lq: lambda ** 2 / (mu * (mu - lambda)),        // expected number in the queue
    ws: 1 / (mu - lambda),                         // expected time in the system
    wq: lambda / (mu * (mu - lambda)),             // expected time in the queue
    lNonEmpty: mu / (mu - lambda),                 // expected length of a queue that is not empty
    pn: (n) => (1 - rho) * rho ** n,               // probability of exactly n in the system
    pMoreThan: (k) => rho ** (k + 1),              // probability of more than k in the system
    pSystemOver: (t) => Math.exp(-(mu - lambda) * t), // P(time in system > t)
    pQueueOver: (t) => rho * Math.exp(-(mu - lambda) * t), // P(time waiting in the queue > t)
  };
}

// Turn "one every x minutes" into a rate per hour, and so on.
export const rateFromGap = (gap, gapUnitPerRateUnit) => gapUnitPerRateUnit / gap;
