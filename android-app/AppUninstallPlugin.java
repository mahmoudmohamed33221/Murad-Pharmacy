package com.muradpharmacy.app;

import android.content.Intent;
import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 1) uninstall: بيفتح شاشة إلغاء تثبيت التطبيق بتاع النظام (أندرويد بيطلب من العميل يدوس "موافق" دايمًا).
 * 2) deviceId: معرّف الجهاز (ANDROID_ID) - بيفضل ثابت حتى لو التطبيق اتحذف ونزل تاني أو اتمسحت بياناته، وبيتغير بس مع فورمات المصنع.
 */
@CapacitorPlugin(name = "AppUninstall")
public class AppUninstallPlugin extends Plugin {
    @PluginMethod
    public void deviceId(PluginCall call) {
        try {
            String id = android.provider.Settings.Secure.getString(
                getContext().getContentResolver(), android.provider.Settings.Secure.ANDROID_ID);
            JSObject o = new JSObject();
            o.put("id", id == null ? "" : id);
            call.resolve(o);
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    @PluginMethod
    public void uninstall(PluginCall call) {
        try {
            Intent i = new Intent(Intent.ACTION_DELETE, Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }
}
