# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows a pragmatic `0.x` release policy:

- breaking API changes may still happen between minor releases
- supported public entry points are documented in `README.md`
- undocumented/internal utilities may change without notice

## [0.1.0] - 2026-04-07

### Added

- Initial release of the single-package `metrickit` library
- Core metrics engine, registry, runtime execution, and cache interfaces
- ORPC helpers via `metrickit/orpc`
- Redis cache adapter via `metrickit/cache-redis`
- Framework-neutral frontend helpers via `metrickit/frontend`
- Advanced helper utilities grouped under `metrickit/helpers`
