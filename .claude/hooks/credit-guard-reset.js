#!/usr/bin/env node
const { readState, writeState, parseInput } = require('./credit-guard-lib.js');

const input = parseInput();
const st = readState(input);
st.toolCount = 0;
st.lastAuthorizedCost = st.lastCost;
writeState(input, st);
process.exit(0);
