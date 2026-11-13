plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
android {
    namespace = "app.lumatube.mobile"
    compileSdk = 35
    defaultConfig {
        applicationId = "app.lumatube.mobile"
        minSdk = 29
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0-preview"
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17; isCoreLibraryDesugaringEnabled = true }
    kotlinOptions { jvmTarget = "17" }
    buildTypes { release { isMinifyEnabled = false } }
    packaging { resources.excludes += setOf("META-INF/DEPENDENCIES", "META-INF/INDEX.LIST") }
}
dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("androidx.media3:media3-exoplayer:1.6.1")
    implementation("androidx.media3:media3-ui:1.6.1")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("net.newpipe:extractor:v0.27.1")
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
}
