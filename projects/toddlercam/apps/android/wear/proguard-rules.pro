# kotlinx.serialization ships its own R8 rules; these keep the shared @Serializable models (core)
# intact so the phone and the watch read each other's Data Layer messages.
-keepattributes *Annotation*, InnerClasses, Signature
-keep,includedescriptorclasses class com.hejitech.toddlercam.core.**$$serializer { *; }
-keepclassmembers class com.hejitech.toddlercam.core.** {
    *** Companion;
    kotlinx.serialization.KSerializer serializer(...);
}
-dontwarn org.slf4j.**
