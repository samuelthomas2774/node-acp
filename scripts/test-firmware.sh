#!/bin/sh

FIRMWARE_URL=$1
FIRMWARE_HASH=$2
DECRYPT_1_HASH=$3
DECRYPT_2_HASH=$4
EXTRACT_HASH=$5

mkdir -p _test/$FIRMWARE_HASH
[ -f _test.gitignore ] || echo "*" > _test/.gitignore
rm _test/$FIRMWARE_HASH/decrypted-*.basebinary
rm _test/$FIRMWARE_HASH/extracted*.basebinary
cd _test/$FIRMWARE_HASH

if [ -f test.basebinary ]
then
    HASH=`cat test.basebinary | openssl dgst -sha256`

    if [ "$HASH" != "$FIRMWARE_HASH" ] && [ "$HASH" != "(stdin)= $FIRMWARE_HASH" ]
    then
        rm test.basebinary
        echo "Deleting existing downloaded firmware file: invalid hash"
    else
        echo "Firmware file already downloaded and matches hash"
    fi
fi

if [ ! -f test.basebinary ]
then
    echo "Downloading firmware file for testing"

    curl -o test.basebinary $FIRMWARE_URL
    EXIT=$? ; if [ "$EXIT" != 0 ] ; then rm test.basebinary ; exit $EXIT ; fi

    HASH=`cat test.basebinary | openssl dgst -sha256`
    echo "$HASH"

    if [ "$HASH" != "$FIRMWARE_HASH" ] && [ "$HASH" != "(stdin)= $FIRMWARE_HASH" ]
    then
        rm test.basebinary
        echo "Failed to download firmware file for testing: invalid hash"
        exit 1
    fi
fi

if [ ! -f decrypted-1.basebinary ]
then
    echo ""
    echo "[1/6] Testing decrypting first image"

    # python -m acp --decrypt test.basebinary decrypted-1.basebinary
    acp firmware-decrypt test.basebinary decrypted-1.basebinary
    EXIT=$?
    if [ "$EXIT" != 0 ] ; then rm decrypted-1.basebinary ; exit $EXIT ; fi

    HASH=`cat decrypted-1.basebinary | openssl dgst -sha256`

    if [ "$HASH" != "$DECRYPT_1_HASH" ] && [ "$HASH" != "(stdin)= $DECRYPT_1_HASH" ]
    then
        rm decrypted-1.basebinary
        echo "Failed to decrypt firmware file (s. 1): invalid hash"
        exit 1
    fi
else
    echo "Already decrypted firmware file (s. 1)"
fi

if [ ! -f decrypted-1-buffered.basebinary ]
then
    echo ""
    echo "[2/6] Testing decrypting first image without streams"

    # python -m acp --decrypt test.basebinary decrypted-1.basebinary
    acp firmware-decrypt test.basebinary decrypted-1-buffered.basebinary --mode buffer
    EXIT=$?
    if [ "$EXIT" != 0 ] ; then rm decrypted-1-buffered.basebinary ; exit $EXIT ; fi

    HASH=`cat decrypted-1-buffered.basebinary | openssl dgst -sha256`

    if [ "$HASH" != "$DECRYPT_1_HASH" ] && [ "$HASH" != "(stdin)= $DECRYPT_1_HASH" ]
    then
        rm decrypted-1-buffered.basebinary
        echo "Failed to decrypt firmware file (s. 1, buffered): invalid hash"
        exit 1
    fi
else
    echo "Already decrypted firmware file (s. 1, buffered)"
fi

if [ ! -f decrypted-2.basebinary ]
then
    echo ""
    echo "[3/6] Testing decrypting internal image"

    # python -m acp --decrypt decrypted-1.basebinary decrypted-2.basebinary
    acp firmware-decrypt decrypted-1.basebinary decrypted-2.basebinary
    EXIT=$?
    if [ "$EXIT" != 0 ] ; then rm decrypted-2.basebinary ; exit $EXIT ; fi

    HASH=`cat decrypted-2.basebinary | openssl dgst -sha256`

    if [ "$HASH" != "$DECRYPT_2_HASH" ] && [ "$HASH" != "(stdin)= $DECRYPT_2_HASH" ]
    then
        rm decrypted-2.basebinary
        echo "Failed to decrypt firmware file (s. 2): invalid hash"
        exit 1
    fi
else
    echo "Already decrypted firmware file (s. 2)"
fi

if [ ! -f decrypted-2-buffered.basebinary ]
then
    echo ""
    echo "[4/6] Testing decrypting internal image without streams"

    # python -m acp --decrypt decrypted-1.basebinary decrypted-2.basebinary
    acp firmware-decrypt decrypted-1.basebinary decrypted-2-buffered.basebinary --mode buffer
    EXIT=$?
    if [ "$EXIT" != 0 ] ; then rm decrypted-2-buffered.basebinary ; exit $EXIT ; fi

    HASH=`cat decrypted-2-buffered.basebinary | openssl dgst -sha256`

    if [ "$HASH" != "$DECRYPT_2_HASH" ] && [ "$HASH" != "(stdin)= $DECRYPT_2_HASH" ]
    then
        rm decrypted-2-buffered.basebinary
        echo "Failed to decrypt firmware file (s. 2, buffered): invalid hash"
        exit 1
    fi
else
    echo "Already decrypted firmware file (s. 2, buffered)"
fi

if [ ! -f extracted.basebinary ]
then
    echo ""
    echo "[5/6] Testing extracting gzimg"

    # python -m acp --extract decrypted-2.basebinary extracted.basebinary
    acp firmware-extract decrypted-2.basebinary extracted.basebinary
    EXIT=$?
    if [ "$EXIT" != 0 ] ; then rm extracted.basebinary ; exit $EXIT ; fi

    HASH=`cat extracted.basebinary | openssl dgst -sha256`

    if [ "$HASH" != "$EXTRACT_HASH" ] && [ "$HASH" != "(stdin)= $EXTRACT_HASH" ]
    then
        rm extracted.basebinary
        echo "Failed to extract gzimg: invalid hash"
        exit 1
    fi
else
    echo "Already extracted gzimg"
fi

if [ ! -f extracted-buffered.basebinary ]
then
    echo ""
    echo "[6/6] Testing extracting gzimg without streams"

    # python -m acp --extract decrypted-2.basebinary extracted.basebinary
    acp firmware-extract decrypted-2.basebinary extracted-buffered.basebinary --mode buffer
    EXIT=$?
    if [ "$EXIT" != 0 ] ; then rm extracted-buffered.basebinary ; exit $EXIT ; fi

    HASH=`cat extracted-buffered.basebinary | openssl dgst -sha256`

    if [ "$HASH" != "$EXTRACT_HASH" ] && [ "$HASH" != "(stdin)= $EXTRACT_HASH" ]
    then
        rm extracted-buffered.basebinary
        echo "Failed to extract gzimg (buffered): invalid hash"
        exit 1
    fi
else
    echo "Already extracted gzimg (buffered)"
fi

echo ""
echo "All tests ran successfully"
echo "You will now have seven firmware files in a _test/* directory (decrypted*/extracted* files will have a *-buffered equivalent):"
echo "    test.basebinary           The original firmware file downloaded from Apple"
echo "    decrypted-1.basebinary    The encrypted firmware file extracted from the file downloaded from Apple"
echo "    decrypted-2.basebinary    The decrypted gzimg"
echo "    extracted.basebinary      The extracted firmware image"
