use icu_collator::options::{CaseLevel, CollatorOptions, Strength};
use icu_collator::preferences::CollationNumericOrdering;
use icu_collator::{Collator, CollatorBorrowed, CollatorPreferences};
use icu_locale_core::Locale;
use rusqlite::functions::FunctionFlags;
use rusqlite::{Connection, Error, Result, ffi};
use std::ffi::{c_char, c_int};
use std::sync::{Arc, RwLock};

const REVISION: &str = concat!("numeric-secondary/1:", env!("KISAKI_ICU_COMPONENTS"));

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

#[unsafe(no_mangle)]
unsafe extern "C" fn sqlite3_extension_init(
    db: *mut ffi::sqlite3,
    error: *mut *mut c_char,
    api: *mut ffi::sqlite3_api_routines,
) -> c_int {
    // SAFETY: SQLite owns these arguments and register only installs connection-local callbacks.
    unsafe { Connection::extension_init2(db, error, api, register) }
}
