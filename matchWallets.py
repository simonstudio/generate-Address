from audioop import add
from itertools import count
import os
from pathlib import Path
import re
from bitarray import test
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
        # print(file.name)
        for line in file:
            if (line.strip() == address):
                # print(line.strip() == address)
                matchedFiles.append(file)
                break
    return matchedFiles


testwallets = [
    "0x0eae0b9ee583524098bca227478cc43413b7f4b9",
    "0x857f876490b63bdc7605165e0df568ae54f72d8e",
    "0x7939001612795afa125a245e1683f8559c7f8db1",
    "0x57790b0b998ba2c9dfe55e73300ffc1d3e457169",
    "0xf977814e90da44bfa03b6295a0616a897441acec",
    "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
    "0xb38e8c17e38363af6ebdcb3dae12e0243582891d",
    "0x28adbdcc50c73609c6bbfaba9c8f2c654439d436",
    "0x14555ef37596407b59b4bc5f8d6b14ece1bd2c9c",
    "0x566f29897282d160438dd62782d8688b638397fa",
    "0x92444c31d74d4f1cd8847927d262c2c8a1ec5993",
    "0x5aba4cb8eceb1727c7fd0aa26d454ee3cc337a92",
    "0x1924cc4fc4b95a4f4dc8ef0bcc140415d4cc85f7",
    "0x038406554ab8179840b81a7716cde701fecaaa58"
]


countScan = len(testwallets) - 1


def scan_random(files, countScan):
    # random wallet
    try:
        # tạo ví
        # (address, private_key) = random_wallet()
        address = testwallets[countScan]
        # match wallet
        matchedFiles = matchWallet(address, files)
        # print(countScan, matchedFiles)
        if len(matchedFiles) > 0:

            # print match wallet
            for file in matchedFiles:
                # print(count, "matched", address, file.name)

                # save match wallet to file
                fileGoodPath = goodWalletsDir + \
                    Path(file.name).stem + ".txt"
                # print(fileGoodPath)
                with open(fileGoodPath, "a+") as fileGood:
                    fileGood.write(address + "\n")
                    fileGood.close()
    except Exception as e:
        print("error: ", e)
    countScan -= 1
    if (countScan >= 0):
        scan_random(files, countScan)


filePaths = glob.glob(topWalletsDir + "*.txt")
files = []
for filePath in filePaths:
    files.append(open(filePath))

scan_random(files, countScan)
# print(files)

# matched = matchWallet("0x038406554ab8179840b81a7716cde701fecaaa58", files)
# for file in matched:
#     print("matched", file.name)

name = "topWallets\\aurorascan.dev.txt"
# print(Path(name).stem)
