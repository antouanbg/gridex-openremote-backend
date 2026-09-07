# GrideX v4 implementation network diagram

[Open the English SVG diagram](GrideX_Network_v4_EN.svg).

The diagram is a generic template for two sites. Additional sites follow the same pattern, each with unique router keys and non-overlapping CONTROL and TELEMETRY prefixes. It contains no real IP addresses or VPN keys.

The blue and green paths represent separate site-router peers connected to one native Windows WireGuard hub. ROCK Pi and ESP32 are internal devices, not VPN peers. MQTTS TCP 8883 is exposed only on the hub VPN address. Public web access on TCP 443/80 is separate and is not a device fallback path.

Each site has separate CONTROL and TELEMETRY networks. RS485 remains local and does not route IP traffic between zones. Vendor OT is behind the second ROCK Pi interface and is not advertised through WireGuard.

The diagram is logical; it is not a packet capture or a complete ACL matrix. The firewall rules and deployment sequence are defined by the runbooks.

This SVG is an English companion to the checksum-controlled Bulgarian PNG. It does not alter the canonical BG package or its manifest.
