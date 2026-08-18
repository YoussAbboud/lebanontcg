#!/usr/bin/env node
// Cert verification stub. Reported outcomes with a cert number sit at
// verified=false; verification is a MANUAL admin step — deliberately no
// scraper here (out of scope by design). When you've checked a cert by
// hand against PSA's public lookup, mark it:
//
//   update pregrade_outcomes set verified = true where cert_number = '...';
//
// This stub exists so the calibration docs have somewhere to point.
console.log('Manual step: verify cert numbers by hand, then set verified=true in pregrade_outcomes.');
console.log('No scraper will be added — see the spec: automated cert lookup is out of scope.');
