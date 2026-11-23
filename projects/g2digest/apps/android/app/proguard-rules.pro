-keep class com.hejitech.g2digest.core.** { *; }
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod
-keepclassmembers class * {
    @kotlinx.serialization.* <fields>;
    @kotlinx.serialization.* <methods>;
}
