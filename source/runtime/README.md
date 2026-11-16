# S.D Factory Enc Android runtime

Runtime package is exactly `com.sdfactory.enc`.

`PayloadDecoder` is the first Java runtime component. It authenticates and
decodes the SDE2 encrypted payload into ordered DEX ByteBuffers. The next
runtime milestone must wire these buffers into an Android shell
`InMemoryDexClassLoader`, then correctly restore the original Application and
component factory lifecycle. Do not inject this decoder alone and call the APK
protected.

The runtime key must be supplied by the native key bridge; never hardcode a
production AES key in Java source.
