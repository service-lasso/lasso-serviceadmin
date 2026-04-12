# Service Install and Setup Config

Use this guide to keep install/setup data consistent across services.

## Required install paths

Record these in service metadata so Installed view is useful:

- install path
- config path
- data path
- optional log/work paths

## Setup flow

A standard setup usually includes:

1. create folders
2. copy config templates
3. set env variables
4. run initial install action

## Config hygiene

- keep defaults versioned
- keep environment-specific values separate
- avoid hard-coding machine-specific paths in docs/examples
