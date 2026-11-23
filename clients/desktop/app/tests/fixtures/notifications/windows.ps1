# Exercises the development notification receiver in a disposable Windows account.

param(
    [ValidateSet('register', 'click', 'remove')][string]$Action,
    [string]$Value
)

$ErrorActionPreference = 'Stop'
$identity = '{1982CC5E-9D53-4DDE-B53D-226C1B20E8A9}'
$classes = [Microsoft.Win32.Registry]::CurrentUser
$path = "Software\Classes\CLSID\$identity"
$server = "$path\LocalServer32"

if ($Action -eq 'register') {
    $existing = $classes.OpenSubKey($path)
    if ($null -ne $existing) {
        $existing.Dispose()
        throw 'The development COM identity already belongs to this account'
    }
    $key = $classes.CreateSubKey($server)
    try { $key.SetValue('', $Value) } finally { $key.Dispose() }
    return
}

if ($Action -eq 'remove') {
    $key = $classes.OpenSubKey($server)
    if ($null -eq $key) { return }
    try {
        if ($key.GetValue('') -ne $Value) { throw 'The registered server changed during the test' }
    } finally {
        $key.Dispose()
    }
    $classes.DeleteSubKey($server)
    $classes.DeleteSubKey($path)
    return
}

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

[ComImport, Guid("53E31837-6600-4A81-9395-75CFFE746F94"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface INotificationActivationCallback {
    void Activate([MarshalAs(UnmanagedType.LPWStr)] string appId,
                  [MarshalAs(UnmanagedType.LPWStr)] string arguments, IntPtr inputs, uint count);
}

public static class KisakiTestNotification {
    public static void Click(Guid identity, string payload) {
        var instance = Activator.CreateInstance(Type.GetTypeFromCLSID(identity));
        try { ((INotificationActivationCallback)instance).Activate("me.kisaki.dev", payload, IntPtr.Zero, 0); }
        finally { Marshal.FinalReleaseComObject(instance); }
    }
}
'@
[KisakiTestNotification]::Click([Guid]$identity, $Value)
