import java.io.FileInputStream
import java.util.Properties

plugins {
    id("com.android.application")
    // START: FlutterFire Configuration
    id("com.google.gms.google-services")
    // END: FlutterFire Configuration
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Load keystore properties
val keystorePropertiesFile = rootProject.file("key.properties")
val keystoreProperties = Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

// Cible JVM du code Kotlin de l'app (l'ancien bloc kotlinOptions est
// refusé par les versions récentes de Kotlin).
kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_11)
    }
}

android {
    namespace = "com.koji.pro"
    compileSdk = flutter.compileSdkVersion
    // NDK demandé par maplibre_gl et integration_test (rétrocompatible).
    ndkVersion = "28.2.13676358"

    compileOptions {
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_11

        targetCompatibility = JavaVersion.VERSION_11
    }


    defaultConfig {
        applicationId = "com.koji.pro"
        minSdk = flutter.minSdkVersion
        // Pinned rather than flutter.targetSdkVersion so an older Flutter SDK
        // on a build machine can't silently ship API 35 (Play requires 36).
        targetSdk = 36
        versionCode = flutter.versionCode

        versionName = flutter.versionName 
        
        multiDexEnabled = true
    }

    // Two store apps from the same code:
    //   flutter run --flavor entreprise -t lib/main_entreprise.dart   (Koji Pro)
    //   flutter run --flavor client     -t lib/main_client.dart       (Koji)
    flavorDimensions += "app"
    productFlavors {
        create("entreprise") {
            dimension = "app"
            // Keeps the existing Play Store app (and its subscriptions).
            applicationId = "com.koji.pro"
            resValue("string", "app_name", "Koji Pro")
        }
        create("client") {
            dimension = "app"
            applicationId = "com.koji.client"
            resValue("string", "app_name", "Koji")
        }
    }

    signingConfigs {
        create("release") {
            keyAlias = keystoreProperties["keyAlias"] as String?
            keyPassword = keystoreProperties["keyPassword"] as String?
            storeFile = (keystoreProperties["storeFile"] as String?)?.let { file(it) }
            storePassword = keystoreProperties["storePassword"] as String?
        }
    }

    // ABI splits disabled - AAB handles this automatically

    buildTypes {
        debug {
            isMinifyEnabled = false
            isShrinkResources = false
        }

        release {
            
            signingConfig = signingConfigs.getByName("release")
            
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    
    packagingOptions {
        jniLibs {
            useLegacyPackaging = false
        }
    }
}

flutter {
    source = "../.."
}

dependencies {
    // Required by flutter_local_notifications (uses java.time APIs on
    // Android < 26). See https://developer.android.com/studio/write/java8-support
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}
