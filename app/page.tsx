"use client";
import { useState, useEffect } from "react";
import { useWalletConnection } from "@solana/react-hooks";
import { Connection, PublicKey, SystemProgram, Keypair, VersionedTransaction, TransactionMessage } from "@solana/web3.js";
import { Program, AnchorProvider, BN, Idl } from "@coral-xyz/anchor";
import idl from "../lib/solana_programs.json";

// Connect to devnet where the program is deployed
const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const PROGRAM_ID = new PublicKey(idl.address);

interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  priceSol: number;
  status: string;
}

export default function Home() {
  const { connectors, connect, disconnect, wallet, status } = useWalletConnection();
  const address = wallet?.account.address.toString();

  const [books, setBooks] = useState<Book[]>([]);
  const [newBook, setNewBook] = useState({ title: "", author: "", description: "", priceSol: "" });
  const [loading, setLoading] = useState(false);

  const fetchBooks = async () => {
    try {
      const res = await fetch("/api/books");
      const data = await res.json();
      setBooks(data);
    } catch (err) {
      console.error("Failed to fetch books", err);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    fetchBooks();
  }, []);

  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newBook.title,
          author: newBook.author,
          description: newBook.description,
          priceSol: parseFloat(newBook.priceSol),
        }),
      });
      setNewBook({ title: "", author: "", description: "", priceSol: "" });
      fetchBooks();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const rentBook = async (book: Book) => {
    if (!wallet || !address) {
      alert("Please connect your wallet first.");
      return;
    }

    try {
      setLoading(true);

      const userPubkey = new PublicKey(address);

      // Derive the PDA for this book's rental record
      const [rentalRecordPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("rental"), Buffer.from(book.id)],
        PROGRAM_ID
      );

      // Treasury: replace with your actual fixed treasury pubkey in production
      const treasuryPubkey = Keypair.generate().publicKey;
      const amount = new BN(book.priceSol * 1e9); // SOL → lamports

      // --- Step 1: Build the Anchor instruction ---
      // Use a read-only no-op wallet just for building the instruction;
      // actual signing happens below via the window provider.
      const readonlyWallet = {
        publicKey: userPubkey,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        signTransaction: async (tx: any) => tx,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        signAllTransactions: async (txs: any[]) => txs,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const provider = new AnchorProvider(connection, readonlyWallet as any, {
        commitment: "confirmed",
      });
      const program = new Program(idl as Idl, provider);

      const instruction = await program.methods
        .rentBook(book.id, amount)
        .accounts({
          rentalRecord: rentalRecordPda,
          user: userPubkey,
          treasury: treasuryPubkey,
          systemProgram: SystemProgram.programId,
        })
        .instruction();

      // --- Step 2: Pack into a VersionedTransaction (V0) ---
      // Phantom (and all modern Solana wallets) support VersionedTransaction natively.
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");

      const message = new TransactionMessage({
        payerKey: userPubkey,
        recentBlockhash: blockhash,
        instructions: [instruction],
      }).compileToV0Message();

      const versionedTx = new VersionedTransaction(message);

      // --- Step 3: Sign & send via window-injected provider ---
      // This bypasses the @solana/react-hooks type mismatch and gives us the
      // raw Phantom / Solflare / Backpack provider that understands VersionedTransaction.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any;
      const provider2 =
        win.phantom?.solana ??  // Phantom
        win.solflare ??          // Solflare
        win.backpack ??          // Backpack
        win.solana;              // Legacy fallback

      if (!provider2) {
        throw new Error(
          "No Solana wallet found in window. Please install Phantom, Solflare, or Backpack."
        );
      }

      let txSignature: string;

      if (typeof provider2.signAndSendTransaction === "function") {
        const result = await provider2.signAndSendTransaction(versionedTx, {
          commitment: "confirmed",
        });
        // Different wallets return { signature } or the string directly
        txSignature =
          typeof result === "string" ? result : result?.signature ?? result;
      } else {
        // Fallback: sign then broadcast
        const signed = await provider2.signTransaction(versionedTx);
        txSignature = await connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: false,
          preflightCommitment: "confirmed",
        });
        await connection.confirmTransaction(
          { signature: txSignature, blockhash, lastValidBlockHeight },
          "confirmed"
        );
      }

      // --- Step 4: Record in off-chain DB ---
      await fetch(`/api/books/${book.id}/rent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userPubkey: address, txSignature }),
      });

      fetchBooks();
      alert(`Book rented! Tx: ${txSignature.slice(0, 8)}…`);
    } catch (err) {
      console.error(err);
      alert(
        `Error renting book: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-12">
        {/* Header & Wallet */}
        <header className="flex justify-between items-center border-b border-gray-700 pb-6">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-emerald-400">
            Decentralized Library
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">
              {status === "connected" ? `Connected: ${address?.slice(0,4)}...${address?.slice(-4)}` : "Not connected"}
            </span>
            {status !== "connected" ? (
              <div className="flex gap-2">
                {connectors.map((c) => (
                  <button key={c.id} onClick={() => connect(c.id)} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-semibold transition">
                    Connect {c.name}
                  </button>
                ))}
              </div>
            ) : (
              <button onClick={() => disconnect()} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-semibold transition">
                Disconnect
              </button>
            )}
          </div>
        </header>

        {/* Add Book Form */}
        <section className="bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-700">
          <h2 className="text-2xl font-semibold mb-4">Add a New Book</h2>
          <form onSubmit={handleAddBook} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input placeholder="Title" required className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none" value={newBook.title} onChange={e => setNewBook({...newBook, title: e.target.value})} />
            <input placeholder="Author" required className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none" value={newBook.author} onChange={e => setNewBook({...newBook, author: e.target.value})} />
            <input placeholder="Description" required className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none md:col-span-2" value={newBook.description} onChange={e => setNewBook({...newBook, description: e.target.value})} />
            <input placeholder="Price in SOL" required type="number" step="0.001" className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none" value={newBook.priceSol} onChange={e => setNewBook({...newBook, priceSol: e.target.value})} />
            <button disabled={loading} type="submit" className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-lg transition duration-200 shadow-lg hover:shadow-emerald-500/20">
              {loading ? "Adding..." : "Add to Catalog"}
            </button>
          </form>
        </section>

        {/* Book Catalog */}
        <section>
          <h2 className="text-3xl font-semibold mb-6">Library Catalog</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {books.map(book => (
              <div key={book.id} className="bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-700 hover:border-gray-500 transition duration-300 flex flex-col justify-between">
                <div>
                  <h3 className="text-xl font-bold mb-1">{book.title}</h3>
                  <p className="text-sm text-gray-400 mb-4">by {book.author}</p>
                  <p className="text-gray-300 text-sm mb-4 line-clamp-3">{book.description}</p>
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
                  <span className="font-mono text-emerald-400 font-semibold">{book.priceSol} SOL</span>
                  {book.status === "AVAILABLE" ? (
                    <button 
                      onClick={() => rentBook(book)}
                      disabled={loading}
                      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-bold shadow transition"
                    >
                      Rent Book
                    </button>
                  ) : (
                    <span className="bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm font-bold opacity-80 cursor-not-allowed">
                      Rented
                    </span>
                  )}
                </div>
              </div>
            ))}
            {books.length === 0 && (
              <p className="text-gray-500 col-span-full text-center py-10">No books in the catalog yet.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
