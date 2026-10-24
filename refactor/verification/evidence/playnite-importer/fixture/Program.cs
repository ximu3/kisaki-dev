using System.IO.Compression;
using System.Text;
using LiteDB;

// Creates synthetic source-format records without loading Playnite or a BSON object mapper.
internal static class Program
{
    private static Guid Id(int n) => Guid.Parse($"10000000-0000-0000-0000-{n:D12}");
    private static BsonDocument Game(int n) => new()
    {
        ["_id"] = Id(n), ["Name"] = $"Synthetic game {n}", ["GameId"] = n.ToString(),
        ["PluginId"] = Guid.Empty, ["Favorite"] = false, ["Hidden"] = false,
        ["Playtime"] = 3600L, ["PlayCount"] = 7L,
        ["Added"] = new DateTime(2025, 7, 3, 10, 20, 30, DateTimeKind.Utc),
        ["CompletionStatusId"] = Id(101), ["IncludeLibraryPluginAction"] = false
    };
    private static byte[] Database(string collection, IEnumerable<BsonDocument> documents, bool deleteLast = false)
    {
        using var stream = new MemoryStream();
        using (var engine = new LiteEngine(new StreamDiskService(stream), utcDate: true))
        {
            foreach (var document in documents) engine.Insert(collection, document, BsonType.Guid);
            if (deleteLast) engine.Delete(collection, Id(99));
        }
        return stream.ToArray();
    }
    private static void Add(ZipArchive zip, string name, byte[] bytes)
    {
        using var output = zip.CreateEntry(name, CompressionLevel.Optimal).Open();
        output.Write(bytes);
    }
    public static int Main(string[] args)
    {
        if (args.Length != 1) return 2;
        var outputDir = Path.GetFullPath(args[0]);
        Directory.CreateDirectory(outputDir);
        var zero = Game(1);
        zero["UserScore"] = 0;
        zero["CategoryIds"] = new BsonArray { Id(301) };
        zero["TagIds"] = new BsonArray { Id(401) };
        zero["Notes"] = "Plain note\n<literal markup> & a second line";
        zero["Favorite"] = true;
        zero["ReleaseDate"] = "2020-5";
        zero["Description"] = "<p>Synthetic description</p>";
        zero["InstallDirectory"] = @"C:\Synthetic Games\One";
        zero["CoverImage"] = "synthetic/cover.png";
        zero["GameActions"] = new BsonArray { new BsonDocument {
            ["Type"] = "File", ["IsPlayAction"] = true, ["Name"] = "File fixture",
            ["Path"] = @"{InstallDir}\game.exe", ["Arguments"] = "--label \"A & B\" --rate 100%",
            ["WorkingDir"] = "{InstallDir}", ["TrackingMode"] = "Default"
        }};
        var full = Game(2);
        full["UserScore"] = 100;
        full["PluginId"] = Guid.Parse("CB91DFC9-B977-43BF-8E70-55F46E410FAB");
        full["GameId"] = "480";
        full["IncludeLibraryPluginAction"] = true;
        full["CompletionStatusId"] = Id(102);
        full["GameActions"] = new BsonArray { new BsonDocument {
            ["Type"] = "URL", ["Path"] = "steam://rungameid/480", ["IsPlayAction"] = true,
            ["TrackingMode"] = "Directory", ["TrackingPath"] = @"C:\Synthetic Games\Two"
        }};
        var nullable = Game(3);
        nullable["UserScore"] = BsonValue.Null;
        nullable["Roms"] = new BsonArray { new BsonDocument { ["Name"] = "Disc one", ["Path"] = @"C:\Synthetic Games\Three\disc.iso" } };
        nullable["GameActions"] = new BsonArray { new BsonDocument {
            ["Type"] = "Emulator", ["IsPlayAction"] = true, ["EmulatorId"] = Id(201),
            ["EmulatorProfileId"] = "synthetic-profile", ["OverrideDefaultArgs"] = false,
            ["AdditionalArguments"] = "--fullscreen"
        }};
        var missing = Game(4);
        missing["GameActions"] = new BsonArray { new BsonDocument {
            ["Type"] = "Script", ["IsPlayAction"] = true, ["Script"] = "Write-Output 'synthetic only'"
        }, new BsonDocument { ["Type"] = "URL", ["IsPlayAction"] = false, ["Path"] = "https://example.invalid/manual" }};
        missing["PreScript"] = "Write-Output 'synthetic hook'";
        missing["CompletionStatusId"] = Id(103);
        var exact = Game(5);
        exact["Playtime"] = 9007199254740993L;
        exact["PlayCount"] = 9007199254740995L;
        exact["_type"] = "Synthetic.Unresolvable.Type, NoSuchAssembly";
        exact["BinaryProbe"] = new byte[] { 0, 1, 127, 255 };
        exact["DecimalProbe"] = 12.345m;
        exact["CompletionStatusId"] = Id(104);
        var games = Database("Game", new[] { zero, full, nullable, missing, exact, Game(99) }, deleteLast: true);
        var statuses = Database("CompletionStatus", new[] {
            new BsonDocument { ["_id"] = Id(101), ["Name"] = "Completed" },
            new BsonDocument { ["_id"] = Id(102), ["Name"] = "My replay state" },
            new BsonDocument { ["_id"] = Id(103), ["Name"] = "Paused by me" },
            new BsonDocument { ["_id"] = Id(104), ["Name"] = "Unmapped fixture" }
        });
        var emulators = Database("Emulator", new[] { new BsonDocument {
            ["_id"] = Id(201), ["Name"] = "Synthetic emulator", ["InstallDir"] = @"C:\Synthetic Emulator",
            ["CustomProfiles"] = new BsonArray { new BsonDocument {
                ["Id"] = "synthetic-profile", ["Name"] = "Synthetic profile",
                ["Executable"] = @"{EmulatorDir}\emulator.exe", ["Arguments"] = "\"{ImagePath}\"",
                ["WorkingDirectory"] = "{EmulatorDir}", ["TrackingMode"] = "ProcessName",
                ["TrackingPath"] = "synthetic-emulator"
            }}
        }});
        var categories = Database("Category", new[] { new BsonDocument { ["_id"] = Id(301), ["Name"] = "My shelf" } });
        var tags = Database("Tag", new[] { new BsonDocument { ["_id"] = Id(401), ["Name"] = "Synthetic tag" } });
        File.WriteAllBytes(Path.Combine(outputDir, "synthetic-games.db"), games);
        using var archiveFile = File.Create(Path.Combine(outputDir, "synthetic-backup.zip"));
        using var zip = new ZipArchive(archiveFile, ZipArchiveMode.Create);
        Add(zip, @"library\database.json", Encoding.UTF8.GetBytes("{\"Version\":4}"));
        Add(zip, @"library\games.db", games);
        Add(zip, @"library\completionstatuses.db", statuses);
        Add(zip, @"library\emulators.db", emulators);
        Add(zip, @"library\categories.db", categories);
        Add(zip, @"library\tags.db", tags);
        Add(zip, @"libraryfiles\synthetic\cover.png", Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1kAAAAASUVORK5CYII="));
        return 0;
    }
}
