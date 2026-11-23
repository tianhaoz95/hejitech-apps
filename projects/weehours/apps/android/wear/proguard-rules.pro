# kotlinx.serialization ships its own R8 rules; these keep Wee Hours' @Serializable models (core,
# the app's and the watch's) intact so field names match Supabase's JSON and the phone and the
# watch read each other's Data Layer messages.
-keepattributes *Annotation*, InnerClasses, Signature
-keep,includedescriptorclasses class com.hejitech.weehours.**$$serializer { *; }
-keepclassmembers class com.hejitech.weehours.** {
    *** Companion;
    kotlinx.serialization.KSerializer serializer(...);
}
-dontwarn org.slf4j.**
