use anchor_lang::prelude::*;

#[error_code]
pub enum LibraryError {
    #[msg("You are not authorized to return this book.")]
    UnauthorizedReturn,
}
