//! Registers the library's language-aware name order on the caller's own SQLite connection.

use icu_collator::options::{CaseLevel, CollatorOptions, Strength};
use icu_collator::preferences::CollationNumericOrdering;
use icu_collator::{Collator, CollatorBorrowed, CollatorPreferences};
use icu_locale_core::Locale;
use rusqlite::functions::FunctionFlags;
use rusqlite::{Connection, Error, Result, ffi};
use std::ffi::{c_char, c_int};
use std::sync::{Arc, RwLock};

/// Identity of the comparison policy and the compiled ICU algorithm and locale data.
const REVISION: &str = concat!("numeric-secondary/1:", env!("KISAKI_ICU_COMPONENTS"));

/// Creates the native numeric, accent-sensitive and case-insensitive order for one BCP 47 locale.
fn name_collator(locale: &str) -> Result<CollatorBorrowed<'static>> {
    let locale: Locale = locale
        .parse()
        .map_err(|e| Error::UserFunctionError(Box::new(e)))?;
    let mut preferences = CollatorPreferences::from(locale);
    preferences.numeric_ordering = Some(CollationNumericOrdering::True);
    let mut options = CollatorOptions::default();
    options.strength = Some(Strength::Secondary);
    options.case_level = Some(CaseLevel::Off);
    Collator::try_new(preferences, options).map_err(|e| Error::UserFunctionError(Box::new(e)))
}

/// Installs the comparison and its connection-local configuration before any index can use it.
fn register(connection: Connection) -> Result<bool> {
    let active = Arc::new(RwLock::new(name_collator("en")?));
    let reader = Arc::clone(&active);
    connection.create_collation(c"kisaki_name", move |left, right| {
        reader.read().unwrap().compare(left, right)
    })?;
    connection.create_scalar_function(
        c"kisaki_set_name_locale",
        1,
        FunctionFlags::SQLITE_UTF8 | FunctionFlags::SQLITE_DIRECTONLY,
        move |context| {
            let next = name_collator(context.get_raw(0).as_str()?)?;
            *active.write().unwrap() = next;
            Ok(REVISION)
        },
    )?;
    Ok(false)
}

/// Loads the private collation through SQLite's extension API, using the driver's own ABI.
///
/// # Safety
/// SQLite supplies the live connection, error slot and API table for this initialization call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn sqlite3_extension_init(
    db: *mut ffi::sqlite3,
    error: *mut *mut c_char,
    api: *mut ffi::sqlite3_api_routines,
) -> c_int {
    // SAFETY: SQLite owns these arguments and register only installs connection-local callbacks.
    unsafe { Connection::extension_init2(db, error, api, register) }
}
