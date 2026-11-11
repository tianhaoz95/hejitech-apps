# kotlinx.serialization, OkHttp and Firebase ship their own R8 rules; these keep the app's
# @Serializable models (core) intact so field names match the Worker's JSON.
-keepattributes *Annotation*, InnerClasses, Signature
-keep,includedescriptorclasses class com.hejitech.headway.core.**$$serializer { *; }
-keepclassmembers class com.hejitech.headway.core.** {
    *** Companion;
    kotlinx.serialization.KSerializer serializer(...);
}
-dontwarn org.slf4j.**
