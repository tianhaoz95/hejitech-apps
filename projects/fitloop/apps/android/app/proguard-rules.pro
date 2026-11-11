# kotlinx.serialization and OkHttp ship their own R8 rules; these keep the app's @Serializable
# models (core) intact so field names match the Worker's JSON.
-keepattributes *Annotation*, InnerClasses, Signature
-keep,includedescriptorclasses class com.hejitech.fitloop.core.**$$serializer { *; }
-keepclassmembers class com.hejitech.fitloop.core.** {
    *** Companion;
    kotlinx.serialization.KSerializer serializer(...);
}
-dontwarn org.slf4j.**
