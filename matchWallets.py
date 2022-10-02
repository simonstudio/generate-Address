from audioop import add
from itertools import count
import os
from pathlib import Path
import re
import ecdsa
import sha3
import random
import glob

topWalletsDir = "topWallets/"
goodWalletsDir = "goodWallets/"


def public_address(private_key_str=None):
    if private_key_str is not None:
        import binascii
        _p = private_key_str.lower()
        _p = bytes(_p, 'utf-8')
        _p = binascii.unhexlify(_p)
        priv = ecdsa.SigningKey.from_string(_p, curve=ecdsa.SECP256k1)
    else:
        priv = ecdsa.SigningKey.generate(curve=ecdsa.SECP256k1)

    pub = priv.get_verifying_key().to_string()
    keccak = sha3.keccak_256()
    keccak.update(pub)
    address = keccak.hexdigest()[24:]
    return address


def create_wallet_from_number(p):
    private_key = hex(p).strip("0x")
    address = public_address(private_key)
    return (address, private_key)


def random_wallet():
    private_key = ""
    i = 0
    for i in range(64):
        n = random.randint(0x0, 0xf)
        if n == 0:
            private_key += "0"
        else:
            private_key += hex(n).strip("0x")
        # if r > 0xf:
        #     print("Error: random bigger than 0xf:" + str(r))
    address = public_address(private_key)
    return address, private_key


def matchWallet(address, files):
    matchedFiles = []
    for file in files:
        for line in file:
            # print(line.strip())
            if (line.strip() == address):
                matchedFiles.append(file)
    return matchedFiles


def scan_random(files):
    count = 0
    while True:
        # random wallet
        try:
            # tạo ví
            (address, private_key) = random_wallet()
            # address = "0x038406554ab8179840b81a7716cde701fecaaa58"
            # match wallet
            matchedFiles = matchWallet(address, files)
            if len(matchedFiles) > 0:

                # print match wallet
                for file in matchedFiles:
                    print("matched", address, file.name)

                    # save match wallet to file
                    fileGoodPath = goodWalletsDir + \
                        Path(file.name).stem + ".txt"
                    with open(fileGoodPath, "a+") as fileGood:
                        fileGood.write(address + "\n")
                        fileGood.close()
        except:
            ()
        print()
        # if (count > 30):
        #     break
        count += 1


filePaths = glob.glob(topWalletsDir + "*.txt")
files = []
for filePath in filePaths:
    files.append(open(filePath))
scan_random(files)
# print(files)

# matched = matchWallet("0x038406554ab8179840b81a7716cde701fecaaa58", files)
# for file in matched:
#     print("matched", file.name)

name = "topWallets\\aurorascan.dev.txt"
# print(Path(name).stem)
