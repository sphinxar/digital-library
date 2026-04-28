import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userPubkey, txSignature } = body;

    if (!userPubkey || !txSignature) {
      return NextResponse.json(
        { error: 'Missing userPubkey or txSignature' },
        { status: 400 }
      );
    }

    const book = await prisma.book.findUnique({ where: { id } });

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    if (book.status === 'AVAILABLE') {
      return NextResponse.json({ error: 'Book is already available' }, { status: 400 });
    }

    // In a real application, you might verify the txSignature here as well.
    // We update the book status back to AVAILABLE.
    // The previous rental record remains in the database for history.

    const updatedBook = await prisma.book.update({
      where: { id },
      data: { status: 'AVAILABLE' },
    });

    return NextResponse.json(updatedBook);
  } catch (error) {
    console.error('Error returning book:', error);
    return NextResponse.json({ error: 'Failed to return book' }, { status: 500 });
  }
}
